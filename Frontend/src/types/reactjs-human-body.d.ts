declare module "reactjs-human-body" {
  import * as React from "react";

  interface BodyPartConfig {
    show: boolean;
  }

  type PartsInput = Record<string, BodyPartConfig>;

  interface BodyComponentProps {
    partsInput?: PartsInput;
    onClick?: (part: string) => void;
  }

  export const BodyComponent: React.ComponentType<BodyComponentProps>;
}