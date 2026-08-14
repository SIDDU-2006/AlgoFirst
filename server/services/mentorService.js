const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'openrouter/free';

// Read API key strictly from environment variables only.
// Do NOT attempt to read or parse files for secrets here to avoid accidental exposure.
function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY || null;
}

function trimLogValue(value, maxLength = 6000) {
  if (value === undefined || value === null) {
    return String(value);
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
}

function extractJsonPayload(text) {
  const source = String(text || '').trim();

  if (source.startsWith('```')) {
    const fenced = source
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    if (fenced) {
      return fenced;
    }
  }

  return source;
}

function isNumberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function requireField(object, fieldName, validator, errorPrefix) {
  if (!Object.prototype.hasOwnProperty.call(object, fieldName)) {
    throw new Error(`${errorPrefix}: missing field \`${fieldName}\``);
  }

  const value = object[fieldName];
  if (!validator(value)) {
    throw new Error(`${errorPrefix}: invalid field \`${fieldName}\``);
  }

  return value;
}

/**
 * Build a comprehensive AI mentor prompt that analyzes REAL code dynamically
 */
function buildMentorPrompt(payload) {
  const {
    problemTitle,
    problemStatement,
    language,
    userCode,
    verdict,
    stderr,
    failedCase,
  } = payload;

  const failedCaseStr = failedCase ? JSON.stringify(failedCase) : 'N/A';
  const verdictStr = verdict || 'Unknown';
  const stderrStr = stderr || 'N/A';

  return `You are AlgoFirst AI Mentor. Analyze this DSA code submission DYNAMICALLY.

PROBLEM:
Title: ${problemTitle}
Statement: ${problemStatement}

SUBMISSION:
Language: ${language}
Code:
\`\`\`${language}
${userCode}
\`\`\`

EXECUTION RESULT:
Verdict: ${verdictStr}
Error (if any): ${stderrStr}
Failed Test Case: ${failedCaseStr}

ANALYSIS RULES:
1. Infer REAL complexity from ACTUAL code (count loops, recursion, data structures)
2. NEVER assume optimal complexity - analyze what the code actually does
3. NEVER use placeholders or generic responses
4. Detect patterns: two-pointer, sliding window, recursion, dynamic programming, brute force, etc.
5. Detect nested loops and their impact on complexity
6. Detect recursion depth and memoization opportunities
7. Identify hashmap/set/heap usage and their complexity benefits
8. Generate concise, actionable feedback
9. Provide edge case examples that might fail
10. Offer practical interview tips

RETURN STRICT JSON ONLY (no markdown, no extra text):

{
  "verdict": "Accepted|Wrong Answer|Time Limit Exceeded|Runtime Error|etc",
  "isClose": false,
  "rootCause": "Brief explanation of the issue or success",
  "complexity": {
    "time": "Actual complexity from the code (e.g., O(n), O(n log n), O(n²))",
    "space": "Actual space complexity (e.g., O(1), O(n), O(log n))",
    "optimalTime": "Optimal possible complexity for this problem",
    "optimalSpace": "Optimal possible space complexity",
    "efficiencyScore": 0-100
  },
  "scores": {
    "time": 0-100,
    "space": 0-100,
    "readability": 0-100,
    "optimization": 0-100,
    "interview": 0-100
  },
  "pattern": "Detected algorithm pattern (e.g., 'Two Pointer', 'Sliding Window', 'DFS', 'BFS', 'Dynamic Programming', 'Brute Force')",
  "improvements": [
    "Specific, actionable improvement 1",
    "Specific, actionable improvement 2"
  ],
  "hints": [
    "What could you optimize?",
    "Have you considered using a different data structure?"
  ],
  "edgeCases": [
    "Empty array/string",
    "Single element",
    "Duplicate values",
    "Negative numbers"
  ],
  "visualization": [
    {
      "step": 1,
      "description": "Initial state",
      "pseudoCode": "array = [...]"
    }
  ],
  "interviewInsight": "Brief tip about what interviewer would want to see during a real interview discussion of this solution"
}

Analyze the code thoroughly and return only valid JSON.`;
}

/**
 * Call OpenRouter API to get AI mentor analysis
 */
async function callOpenRouterAPI(prompt) {
  const apiKey = getOpenRouterApiKey();

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured in server/.env');
  }

  const requestStart = Date.now();

  console.log(`[MentorAI] Request start | model=${OPENROUTER_MODEL} | promptChars=${prompt.length}`);
  console.log(`[MentorAI] Prompt preview: ${trimLogValue(prompt, 1500)}`);

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://algofirst.dev',
          'X-Title': 'AlgoFirst AI Mentor',
        },
      },
    );

    const latencyMs = Date.now() - requestStart;
    const responseBody = response.data || {};
    const responseModel = responseBody.model || OPENROUTER_MODEL;
    const usage = responseBody.usage || {};

    console.log(`[MentorAI] Response success | status=${response.status} | latencyMs=${latencyMs}`);
    console.log(`[MentorAI] Response model=${responseModel} | usage=${trimLogValue(usage, 1200)}`);
    console.log(`[MentorAI] Response body=${trimLogValue(responseBody)}`);

    if (!responseBody.choices || responseBody.choices.length === 0) {
      throw new Error('No response from OpenRouter API');
    }

    const message = responseBody.choices[0].message;
    if (!message) {
      throw new Error('No message in response from OpenRouter');
    }

    // Try content field first, then reasoning field (for some models)
    let content = message.content;
    if (!content && message.reasoning) {
      content = message.reasoning;
      console.log('Using reasoning field instead of content');
    }

    if (!content) {
      throw new Error('No usable content from OpenRouter response');
    }

    return {
      content: content.trim(),
      metadata: {
        status: response.status,
        latencyMs,
        model: responseModel,
        usage,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - requestStart;
    console.error(`[MentorAI] OpenRouter API error | latencyMs=${latencyMs} | reason=${error.message}`);
    if (error.response) {
      console.error(`[MentorAI] OpenRouter error status=${error.response.status}`);
      console.error(`[MentorAI] OpenRouter error body=${trimLogValue(error.response.data)}`);
    }
    throw new Error(`OpenRouter API failed: ${error.message}`);
  }
}

/**
 * Parse JSON response and validate structure
 */
function parseAndValidateMentorJSON(jsonStr) {
  try {
    const cleanJson = extractJsonPayload(jsonStr);
    const parsed = JSON.parse(cleanJson);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Top-level response must be a JSON object');
    }

    const verdict = requireField(parsed, 'verdict', (value) => typeof value === 'string' && value.trim().length > 0, 'Mentor JSON validation');
    const isClose = requireField(parsed, 'isClose', (value) => typeof value === 'boolean', 'Mentor JSON validation');
    const rootCause = requireField(parsed, 'rootCause', (value) => typeof value === 'string' && value.trim().length > 0, 'Mentor JSON validation');
    const pattern = requireField(parsed, 'pattern', (value) => typeof value === 'string' && value.trim().length > 0, 'Mentor JSON validation');
    const interviewInsight = requireField(parsed, 'interviewInsight', (value) => typeof value === 'string' && value.trim().length > 0, 'Mentor JSON validation');

    const complexity = requireField(parsed, 'complexity', (value) => value && typeof value === 'object' && !Array.isArray(value), 'Mentor JSON validation');
    const scores = requireField(parsed, 'scores', (value) => value && typeof value === 'object' && !Array.isArray(value), 'Mentor JSON validation');

    const validatedComplexity = {
      time: requireField(complexity, 'time', (value) => typeof value === 'string' && value.trim().length > 0, 'Mentor JSON complexity validation'),
      space: requireField(complexity, 'space', (value) => typeof value === 'string' && value.trim().length > 0, 'Mentor JSON complexity validation'),
      optimalTime: requireField(complexity, 'optimalTime', (value) => typeof value === 'string' && value.trim().length > 0, 'Mentor JSON complexity validation'),
      optimalSpace: requireField(complexity, 'optimalSpace', (value) => typeof value === 'string' && value.trim().length > 0, 'Mentor JSON complexity validation'),
      efficiencyScore: requireField(complexity, 'efficiencyScore', (value) => isNumberInRange(value, 0, 100), 'Mentor JSON complexity validation'),
      currentTime: typeof complexity.currentTime === 'string' && complexity.currentTime.trim().length > 0 ? complexity.currentTime : complexity.time,
      currentSpace: typeof complexity.currentSpace === 'string' && complexity.currentSpace.trim().length > 0 ? complexity.currentSpace : complexity.space,
    };

    const validatedScores = {
      time: requireField(scores, 'time', (value) => isNumberInRange(value, 0, 100), 'Mentor JSON scores validation'),
      space: requireField(scores, 'space', (value) => isNumberInRange(value, 0, 100), 'Mentor JSON scores validation'),
      readability: requireField(scores, 'readability', (value) => isNumberInRange(value, 0, 100), 'Mentor JSON scores validation'),
      optimization: requireField(scores, 'optimization', (value) => isNumberInRange(value, 0, 100), 'Mentor JSON scores validation'),
      interview: requireField(scores, 'interview', (value) => isNumberInRange(value, 0, 100), 'Mentor JSON scores validation'),
    };

    const improvements = requireField(parsed, 'improvements', (value) => Array.isArray(value), 'Mentor JSON validation');
    const hints = requireField(parsed, 'hints', (value) => Array.isArray(value), 'Mentor JSON validation');
    const edgeCases = requireField(parsed, 'edgeCases', (value) => Array.isArray(value), 'Mentor JSON validation');
    const visualization = requireField(parsed, 'visualization', (value) => Array.isArray(value), 'Mentor JSON validation');

    return {
      verdict,
      isClose,
      rootCause,
      complexity: validatedComplexity,
      scores: validatedScores,
      pattern,
      improvements: improvements.slice(0, 5),
      hints: hints.slice(0, 5),
      edgeCases: edgeCases.slice(0, 5),
      visualization: visualization.slice(0, 3),
      interviewInsight,
    };
  } catch (error) {
    console.error(`[MentorAI] JSON parse/validation error: ${error.message}`);
    console.error(`[MentorAI] Raw model output: ${trimLogValue(jsonStr)}`);
    throw new Error(`Invalid JSON response from OpenRouter: ${error.message}`);
  }
}

/**
 * Main function: Analyze code using OpenRouter AI
 */
async function analyzeMentorFeedback(payload) {
  const prompt = buildMentorPrompt(payload);
  const apiResult = await callOpenRouterAPI(prompt);
  const mentorAnalysis = parseAndValidateMentorJSON(apiResult.content);

  console.log(`[MentorAI] Parsed mentor analysis: ${trimLogValue(mentorAnalysis, 2000)}`);
  console.log(
    `[MentorAI] Completed | model=${apiResult.metadata.model} | latencyMs=${apiResult.metadata.latencyMs} | status=${apiResult.metadata.status}`,
  );

  return mentorAnalysis;
}

module.exports = {
  analyzeMentorFeedback,
};
