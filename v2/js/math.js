export function randomGaussian(mean = 0, stdDev = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

export function sampleChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}
