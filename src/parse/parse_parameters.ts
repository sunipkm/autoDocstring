import { guessType } from ".";
import {
    Argument,
    Decorator,
    DocstringParts,
    Exception,
    Assertion,
    KeywordArgument,
    Returns,
    Yields,
} from "../docstring_parts";

export function parseParameters(
    parameterTokens: string[],
    body: string[],
    functionName: string,
): DocstringParts {
    return {
        name: functionName,
        decorators: parseDecorators(parameterTokens),
        args: parseArguments(parameterTokens),
        kwargs: parseKeywordArguments(parameterTokens),
        returns: parseReturn(parameterTokens, body),
        yields: parseYields(parameterTokens, body),
        exceptions: parseExceptions(body),
        assertions: parseAssertions(body),
    };
}

function parseDecorators(parameters: string[]): Decorator[] {
    const decorators: Decorator[] = [];
    const pattern = /^@(\w+)/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == null) {
            continue;
        }

        decorators.push({
            name: match[1],
        });
    }

    return decorators;
}

function parseArguments(parameters: string[]): Argument[] {
    const args: Argument[] = [];
    const excludedArgs = ["self", "cls"];
    const pattern = /^(\w+)/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == null || param.includes("=") || inArray(param, excludedArgs)) {
            continue;
        }

        args.push({
            var: match[1],
            type: guessType(param),
        });
    }

    return args;
}

function parseKeywordArguments(parameters: string[]): KeywordArgument[] {
    const kwargs: KeywordArgument[] = [];
    const pattern = /^(\w+)(?:\s*:[^=]+)?\s*=\s*(.+)/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == null) {
            continue;
        }

        kwargs.push({
            var: match[1],
            default: match[2],
            type: guessType(param),
        });
    }

    return kwargs;
}

function parseReturn(parameters: string[], body: string[]): Returns {
    const returnType = parseReturnFromDefinition(parameters);

    if (returnType == null || isIterator(returnType.type)) {
        return parseFromBody(body, /return /);
    }

    return returnType;
}

function parseYields(parameters: string[], body: string[]): Yields {
    const returnType = parseReturnFromDefinition(parameters);

    if (returnType != null && isIterator(returnType.type)) {
        return returnType as Yields;
    }

    // To account for functions that yield but don't have a yield signature
    const yieldType = returnType ? returnType.type : undefined;
    const yieldInBody = parseFromBody(body, /yield /);

    if (yieldInBody != null && yieldType != undefined) {
        yieldInBody.type = `Iterator[${yieldType}]`;
    }

    return yieldInBody;
}

function parseReturnFromDefinition(parameters: string[]): Returns | null {
    const pattern = /^->\s*(["']?)(['"\w\[\], |\.]*)\1/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == null) {
            continue;
        }

        // Skip "-> None" annotations
        return match[2] === "None" ? null : { type: match[2] };
    }

    return null;
}

function parseExceptions(body: string[]): Exception[] {
    const exceptions: Exception[] = [];
    const pattern = /(?<!#.*)raise\s+([\w.]+)/;

    for (const line of body) {
        const match = line.match(pattern);

        if (match == null) {
            continue;
        }

        exceptions.push({ type: match[1] });
    }

    return exceptions;
}

function parseAssertions(body: string[]): Assertion[] {
    const assertions: Assertion[] = [];
    const pattern = /(?<!#.*)assert\s*([\w\.\-\(].*)/;

    for (const line of body) {
        const match = line.match(pattern);

        if (match == null) {
            continue;
        }

        assertions.push({ stmt: match[1] });
    }

    return assertions;
}

export function inArray<type>(item: type, array: type[]) {
    return array.some((x) => item === x);
}

function parseFromBody(body: string[], pattern: RegExp): Returns | Yields {
    for (const line of body) {
        const match = line.match(pattern);

        if (match == null) {
            continue;
        }

        return { type: undefined };
    }

    return undefined;
}

function isIterator(type: string): boolean {
    return type.startsWith("Generator") || type.startsWith("Iterator");
}
