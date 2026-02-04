import * as React from "react";

export function getStrictContext(name) {
  const Context = React.createContext(undefined);
  const useContext = () => {
    const value = React.useContext(Context);
    if (!value) {
      throw new Error(`${name} must be used within ${name}.`);
    }
    return value;
  };
  return [Context.Provider, useContext];
}
