export function awaitWithTimeout(promise, timeout = 2000) {
  return new Promise((resolve, reject) => {

    const timer = setTimeout(() => {
      reject(new Error("Timeout"));
    }, timeout);

    promise
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });

  });
}