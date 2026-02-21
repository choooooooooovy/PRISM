'use client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://127.0.0.1:8000';
const SESSION_STORAGE_KEY = 'prism_session_id';

interface SessionResponse {
  id: string;
}

interface AiRunResponse {
  session_id: string;
  task_type: string;
  output_json: Record<string, unknown>;
  prompt_run_id: string;
  artifact_id?: string;
  meta?: {
    run_id?: string;
  };
}

export interface ApiErrorInfo {
  status: number;
  message: string;
  runId?: string;
}

export class ApiError extends Error {
  info: ApiErrorInfo;

  constructor(info: ApiErrorInfo) {
    super(info.message);
    this.name = 'ApiError';
    this.info = info;
  }
}

interface SessionDetailResponse {
  id: string;
  artifacts: Array<{
    artifact_type: string;
    phase: string;
    step: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
  messages: Array<{
    phase: string;
    step: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }>;
}

function parseErrorPayload(status: number, raw: string): ApiError {
  try {
    const parsed = JSON.parse(raw) as {
      detail?: { message?: string; run_id?: string } | string;
    };
    const detail = parsed.detail;
    if (typeof detail === 'string') {
      return new ApiError({ status, message: detail });
    }
    if (detail && typeof detail === 'object') {
      return new ApiError({
        status,
        message: detail.message || '요청 처리 중 오류가 발생했습니다.',
        runId: detail.run_id,
      });
    }
  } catch {
    // no-op: raw body was not JSON
  }
  return new ApiError({
    status,
    message: raw || `요청 처리 중 오류가 발생했습니다. (HTTP ${status})`,
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw parseErrorPayload(res.status, text || res.statusText);
  }

  return (await res.json()) as T;
}

export async function getOrCreateSessionId(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Session can only be resolved on the client');
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    try {
      await request<SessionDetailResponse>(`/sessions/${existing}`);
      return existing;
    } catch (err) {
      if (!(err instanceof ApiError) || err.info.status !== 404) {
        throw err;
      }
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  const session = await request<SessionResponse>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'PRISM Session' }),
  });
  window.localStorage.setItem(SESSION_STORAGE_KEY, session.id);
  return session.id;
}

export async function runTask(
  taskType:
    | 'phase1_interview_turn'
    | 'phase1_extract_structured'
    | 'phase1_generate_personas'
    | 'phase2_explore'
    | 'phase2_generate_candidates'
    | 'phase3_generate_comments_and_drafts'
    | 'phase3_generate_votes'
    | 'phase4_generate_preparation'
    | 'phase4_reality_interview_turn'
    | 'phase4_roadmap_interview_turn'
    | 'phase4_2_interview_turn'
    | 'phase4_3_interview_turn',
  inputJson: Record<string, unknown> = {},
): Promise<AiRunResponse> {
  const sessionId = await getOrCreateSessionId();

  const response = await request<AiRunResponse>('/ai/run', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      task_type: taskType,
      input_json: inputJson,
      prompt_version: 'v1',
    }),
  });
  if (response.meta?.run_id) {
    // Keep minimal traceability for live debugging.
    console.info(`[PRISM] run_id=${response.meta.run_id} task=${taskType}`);
  }
  return response;
}

export async function getSessionDetail(): Promise<SessionDetailResponse> {
  const sessionId = await getOrCreateSessionId();
  return request<SessionDetailResponse>(`/sessions/${sessionId}`);
}

export async function getLatestArtifact<T>(artifactType: string): Promise<T | null> {
  const detail = await getSessionDetail();
  const found = detail.artifacts.find(a => a.artifact_type === artifactType);
  return (found?.payload as T | undefined) ?? null;
}

export async function upsertArtifact(params: {
  phase: string;
  step: string;
  artifactType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const sessionId = await getOrCreateSessionId();
  await request(`/sessions/${sessionId}/artifacts`, {
    method: 'PATCH',
    body: JSON.stringify({
      phase: params.phase,
      step: params.step,
      artifact_type: params.artifactType,
      payload: params.payload,
    }),
  });
}

export async function getMessagesByStep(
  phase: string,
  step: string,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const detail = await getSessionDetail();
  return detail.messages
    .filter(msg => msg.phase === phase && msg.step === step)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(msg => ({ role: msg.role, content: msg.content }));
}

export function getUserErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.info.runId) {
      return `${error.info.message} (run_id: ${error.info.runId})`;
    }
    return error.info.message;
  }
  if (error instanceof Error && error.message) {
    if (/failed to fetch/i.test(error.message)) {
      return '백엔드 서버에 연결할 수 없습니다. 백엔드를 실행한 뒤 다시 시도해 주세요.';
    }
    return error.message;
  }
  return fallback;
}
