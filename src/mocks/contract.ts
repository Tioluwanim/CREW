type Operation = {
  responses: Record<string, { content?: Record<string, { schema: unknown }> }>;
};

type OpenApiDocument = {
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, unknown> };
};

type ResponseValidator = { validateResponse: (status: string, response: unknown) => unknown };

let documentPromise: Promise<OpenApiDocument> | undefined;
const validators = new Map<string, ResponseValidator>();

async function loadDocument() {
  documentPromise ??= Promise.all([import('node:fs'), import('yaml')]).then(([fs, yaml]) =>
    yaml.parse(fs.readFileSync(`${process.cwd()}/openapi.yaml`, 'utf8')) as OpenApiDocument,
  );
  return documentPromise;
}

async function getValidator(path: string, method: string) {
  const key = `${method.toLowerCase()} ${path}`;
  const cached = validators.get(key);
  if (cached) return cached;

  const document = await loadDocument();
  const operation = document.paths[path]?.[method.toLowerCase()];
  if (!operation) throw new Error(`No OpenAPI operation found for ${key}`);

  const responses = Object.fromEntries(
    Object.entries(operation.responses).map(([status, response]) => [
      status,
      { schema: response.content?.['application/json']?.schema ?? {} },
    ]),
  );
  const { default: OpenAPIResponseValidator } = await import('openapi-response-validator');
  const validator = new OpenAPIResponseValidator({
    responses,
    components: document.components,
  });
  validators.set(key, validator);
  return validator;
}

export async function validateResponse(path: string, method: string, status: number, body: unknown) {
  const validationError = (await getValidator(path, method)).validateResponse(String(status), body);
  if (validationError) {
    throw new Error(`${method.toUpperCase()} ${path} returned an invalid ${status} response: ${JSON.stringify(validationError)}`);
  }
  return body;
}
