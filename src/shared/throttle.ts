export function throttle<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let last = 0;
  let timer: number | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remain = wait - (now - last);

    if (remain <= 0) {
      if (timer) window.clearTimeout(timer);
      timer = null;
      last = now;
      fn(...args);
      return;
    }

    if (!timer) {
      timer = window.setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...args);
      }, remain);
    }
  };
}
