import { MISTRAL_AI } from '../../globals';
import { Params } from '../../types/requestBody';
import {
  ChatCompletionResponse,
  ErrorResponse,
  ProviderConfig,
} from '../types';
import {
  generateErrorResponse,
  generateInvalidProviderResponseError,
} from '../utils';

export const MistralAIChatCompleteConfig: ProviderConfig = {
  model: {
    param: 'model',
    required: true,
    default: 'mistral-tiny',
  },
  messages: {
    param: 'messages',
    default: [],
    transform: (params: Params) => {
      return params.messages?.map((message) => {
        if (message.role === 'developer') return { ...message, role: 'system' };
        return message;
      });
    },
  },
  temperature: {
    param: 'temperature',
    default: 0.7,
    min: 0,
    max: 1,
  },
  top_p: {
    param: 'top_p',
    default: 1,
    min: 0,
    max: 1,
  },
  max_tokens: {
    param: 'max_tokens',
    default: null,
    min: 1,
  },
  max_completion_tokens: {
    param: 'max_tokens',
    default: null,
    min: 1,
  },
  stream: {
    param: 'stream',
    default: false,
  },
  seed: {
    param: 'random_seed',
    default: null,
  },
  safe_prompt: {
    param: 'safe_prompt',
    default: false,
  },
  // TODO: deprecate this and move to safe_prompt in next release
  safe_mode: {
    param: 'safe_prompt',
    default: false,
  },
  prompt: {
    param: 'prompt',
    required: false,
    default: '',
  },
  suffix: {
    param: 'suffix',
    required: false,
    default: '',
  },
  tools: {
    param: 'tools',
    default: null,
  },
  tool_choice: {
    param: 'tool_choice',
    default: null,
    transform: (params: Params) => {
      if (
        typeof params.tool_choice === 'string' &&
        params.tool_choice === 'required'
      ) {
        return 'any';
      }
      return params.tool_choice;
    },
  },
  parallel_tool_calls: {
    param: 'parallel_tool_calls',
    default: null,
  },
};

interface MistralToolCallFunction {
  name: string;
  arguments: string;
}

interface MistralToolCall {
  id: string;
  type: string;
  function: MistralToolCallFunction;
}

interface MistralAIChatCompleteResponse extends ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MistralAIErrorResponse {
  object: string;
  message: string;
  type: string;
  param: string | null;
  code: string;
}

interface MistralAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    delta: {
      role?: string | null;
      content?: string;
      tool_calls?: MistralToolCall[];
    };
    index: number;
    finish_reason: string | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const MistralAIChatCompleteResponseTransform: (
  response: MistralAIChatCompleteResponse | MistralAIErrorResponse,
  responseStatus: number
) => ChatCompletionResponse | ErrorResponse = (response, responseStatus) => {
  if ('message' in response && responseStatus !== 200) {
    return generateErrorResponse(
      {
        message: response.message,
        type: response.type,
        param: response.param,
        code: response.code,
      },
      MISTRAL_AI
    );
  }

  if ('choices' in response) {
    return {
      id: response.id,
      object: response.object,
      created: response.created,
      model: response.model,
      provider: MISTRAL_AI,
      choices: response.choices.map((c) => ({
        index: c.index,
        message: {
          role: c.message.role,
          content: c.message.content,
          tool_calls: c.message.tool_calls,
        },
        finish_reason: c.finish_reason,
      })),
      usage: {
        prompt_tokens: response.usage?.prompt_tokens,
        completion_tokens: response.usage?.completion_tokens,
        total_tokens: response.usage?.total_tokens,
      },
    };
  }

  return generateInvalidProviderResponseError(response, MISTRAL_AI);
};

export const MistralAIChatCompleteStreamChunkTransform: (
  response: string
) => string = (responseChunk) => {
  let chunk = responseChunk.trim();
  chunk = chunk.replace(/^data: /, '');
  chunk = chunk.trim();
  if (chunk === '[DONE]') {
    return `data: ${chunk}\n\n`;
  }
  const parsedChunk: MistralAIStreamChunk = JSON.parse(chunk);
  return (
    `data: ${JSON.stringify({
      id: parsedChunk.id,
      object: parsedChunk.object,
      created: parsedChunk.created,
      model: parsedChunk.model,
      provider: MISTRAL_AI,
      choices: [
        {
          index: parsedChunk.choices[0].index,
          delta: parsedChunk.choices[0].delta,
          finish_reason: parsedChunk.choices[0].finish_reason,
        },
      ],
      ...(parsedChunk.usage ? { usage: parsedChunk.usage } : {}),
    })}` + '\n\n'
  );
};
