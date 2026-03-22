interface RandomStringInput {
  prefix: string;
}

let randomCounter = 0;

export const randomString = (input: RandomStringInput): string => {
  const { prefix } = input;
  const randomPart = Math.random().toString(36).slice(2, 10);

  randomCounter += 1;

  return prefix + '-' + randomPart + '-' + randomCounter;
};
