export const before = <TType extends (...args: any[]) => any>(
  type: TType,
  before: (...args: Parameters<TType>) => Parameters<TType>
): TType => {
  const wrapped = ((...args: Parameters<TType>): ReturnType<TType> => {
    const nextArgs = before(...args);
    return type(...nextArgs);
  }) as TType;

  return Object.assign(wrapped, type);
};
