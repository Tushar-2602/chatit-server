export const emitError = (instance, err,code=0) => {
    const error = err instanceof Error ? err : new Error(err);

    if (instance.listenerCount("error") > 0) {
        instance.emit("error", {
            error,
            code
        });
    } else {
        console.error("errorLog "+error);
    }
};

export const sendWsError = (ws, err,code,messageId) => {
     const errorMsg = err instanceof Error ? err.message : err;

        try {
            ws.send(JSON.stringify({
                msgType: "system",
                subType: "error",
                payload: errorMsg,
                ...(messageId && {messageId}),
                code
            }));
        } catch {}

};
