export const after = <TType extends (...args: any[]) => any>(type: TType, after: (value: ReturnType<TType>) => ReturnType<TType>): TType => {
  const wrapped = ((...args: Parameters<TType>): ReturnType<TType> => {
    const result = type(...args);
    const nextResult = after(result);
    return nextResult;
  }) as TType;

  return Object.assign(wrapped, type);
};
