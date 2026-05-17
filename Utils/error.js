export const emitError = (instance, err) => {
    const error = err instanceof Error ? err : new Error(err);

    if (instance.listenerCount("error") > 0) {
        instance.emit("error", error);
    } else {
        console.error("errorLog "+error);
    }
};

export const sendWsError = (ws, err,code) => {
     const errorMsg = err instanceof Error ? err.message : err;

        try {
            ws.send(JSON.stringify({
                msgType: "sys",
                subType: "error",
                payload: errorMsg,
                Errorcode:code
            }));
        } catch {}

};
