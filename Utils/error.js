// export const emitError = (instance, err,code=0) => {
//     const error = err instanceof Error ? err : new Error(err);

//     if (instance.listenerCount("error") > 0) {
//         instance.emit("error", {
//             error,
//             code
//         });
//     } else {
//         console.error("errorLog "+error);
//     }
// };

export class LibError extends Error {
  constructor(err, code = 1000, data = {}) {
    if (err instanceof LibError) {
      return err;
    }

    if (err instanceof Error) {
      super(err.message, { cause: err });
    } else {
      super(String(err));
    }

    this.success = false;
    this.code = code;
    this.data = data;
  }
}

export class LibReturn {
   constructor(data = {},code = 201) {
   this.success = true;
    this.code = code;
    this.data = data;
   }

}

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
