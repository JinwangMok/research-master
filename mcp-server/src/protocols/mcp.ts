// mcp-server/src/protocols/mcp.ts
export interface MCPMessage {
    id: string;
    type: "request" | "response" | "notification";
    method: string;
    params?: any;
    result?: any;
    error?: MCPError;
    timestamp: number;
}

export interface MCPError {
    code: number;
    message: string;
    data?: any;
}

export enum MCPErrorCode {
    PARSE_ERROR = -32700,
    INVALID_REQUEST = -32600,
    METHOD_NOT_FOUND = -32601,
    INVALID_PARAMS = -32602,
    INTERNAL_ERROR = -32603,
    SERVER_ERROR = -32000,
}

export class MCPProtocol {
    static createRequest(method: string, params?: any): MCPMessage {
        return {
            id: Date.now().toString(),
            type: "request",
            method,
            params,
            timestamp: Date.now(),
        };
    }

    static createResponse(requestId: string, result?: any): MCPMessage {
        return {
            id: requestId,
            type: "response",
            method: "",
            result,
            timestamp: Date.now(),
        };
    }

    static createError(
        requestId: string,
        code: number,
        message: string,
        data?: any
    ): MCPMessage {
        return {
            id: requestId,
            type: "response",
            method: "",
            error: { code, message, data },
            timestamp: Date.now(),
        };
    }

    static createNotification(method: string, params?: any): MCPMessage {
        return {
            id: Date.now().toString(),
            type: "notification",
            method,
            params,
            timestamp: Date.now(),
        };
    }

    static validate(message: any): boolean {
        if (!message || typeof message !== "object") return false;
        if (!message.id || !message.type || !message.method) return false;
        if (!["request", "response", "notification"].includes(message.type))
            return false;
        return true;
    }
}
