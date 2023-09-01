export type TGraphDatabaseResult<TSuccess extends boolean, TSuccessMessage extends string, TErrorMessage extends string, TData = undefined> = 
    TSuccess extends true ? {
        success: true,
        error: false,
        userFriendlyMessage: TSuccessMessage,
        data: TData
    } : TSuccess extends false ? {
        success: false,
        error: true,
        userFriendlyMessage: TErrorMessage,
        devMessage: string,
        data?: never
    } : never;

export type TGraphDatabaseResultSpec<TSuccessMessage extends string, TErrorMessage extends string, TData = undefined> = TGraphDatabaseResult<any, TSuccessMessage, TErrorMessage, TData>;

export function createGraphDatabaseErrorResult<TErrorMessage extends string>(userFriendlyErrorMessage: TErrorMessage, caughtError: unknown) {
    return {
        success: false,
        error: true,
        userFriendlyMessage: userFriendlyErrorMessage,
        devMessage: userFriendlyErrorMessage.toLowerCase() + " " + (caughtError instanceof Error ? caughtError.message : "no details available.")
    } as const;
}