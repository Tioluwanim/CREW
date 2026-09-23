import { readFileSync } from 'node:fs';
import OpenAPIResponseValidator from 'openapi-response-validator';
import { parse } from 'yaml';

type Operation = {
  responses: Record<string, { content?: Record<string, { schema: unknown }> }>;
};

type OpenApiDocument = {
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, unknown> };
};

const document = parse(readFileSync(new URL('../../openapi.yaml', import.meta.url), 'utf8')) as OpenApiDocument;

const validators = new Map<string, OpenAPIResponseValidator>();

function getValidator(path: string, method: string) {
  const key = `${method.toLowerCase()} ${path}`;
  const cached = validators.get(key);
  if (cached) return cached;

  const operation = document.paths[path]?.[method.toLowerCase()];
  if (!operation) throw new Error(`No OpenAPI operation found for ${key}`);

  const responses = Object.fromEntries(
    Object.entries(operation.responses).map(([status, response]) => [
      status,
      { schema: response.content?.['application/json']?.schema ?? {} },
    ]),
  );
  const validator = new OpenAPIResponseValidator({
    responses,
    components: document.components,
  });
  validators.set(key, validator);
  return validator;
}

export function validateResponse(path: string, method: string, status: number, body: unknown) {
  const validationError = getValidator(path, method).validateResponse(String(status), body);
  if (validationError) {
    throw new Error(`${method.toUpperCase()} ${path} returned an invalid ${status} response: ${JSON.stringify(validationError)}`);
  }
  return body;
}
