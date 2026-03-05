export const userHasRole = (userRoles: string[], requiredRoles: string[]): boolean => {
  return requiredRoles.some((role) => userRoles.includes(role));
};

export const userHasAllRoles = (userRoles: string[], requiredRoles: string[]): boolean => {
  return requiredRoles.every((role) => userRoles.includes(role));
};
