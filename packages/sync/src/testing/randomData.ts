interface RandomStringInput {
  prefix: string;
}

interface RandomNumberInput {
  min?: number;
  max?: number;
}

let randomCounter = 0;

export const randomString = (input: RandomStringInput): string => {
  const { prefix } = input;
  const randomPart = Math.random().toString(36).slice(2, 10);

  randomCounter += 1;

  return prefix + '-' + randomPart + '-' + randomCounter;
};

export const randomNumber = (input: RandomNumberInput = {}): number => {
  const { min = 1, max = 1_000_000 } = input;
  const distance = max - min + 1;
  const value = Math.floor(Math.random() * distance);

  return min + value;
};
