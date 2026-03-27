import { Component, type ErrorInfo, type ReactNode } from "react";
import { BodyComponent } from "reactjs-human-body";

interface HumanBodyModelProps {
  onPartClick?: (part: string) => void;
}

interface BodyModelErrorBoundaryState {
  hasError: boolean;
}

class BodyModelErrorBoundary extends Component<{ children: ReactNode }, BodyModelErrorBoundaryState> {
  state: BodyModelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): BodyModelErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Intentionally suppress runtime failures from third-party visual component.
  }

  render() {
    if (this.state.hasError) {
      return <FallbackBodyModel />;
    }

    return this.props.children;
  }
}

const partsInput = {
  head: { show: true, selected: true },
  leftShoulder: { show: true },
  rightShoulder: { show: true },
  leftArm: { show: true },
  rightArm: { show: true, selected: true },
  chest: { show: true, selected: true },
  stomach: { show: true },
  leftLeg: { show: true },
  rightLeg: { show: true },
  leftHand: { show: true, selected: true },
  rightHand: { show: true },
  leftFoot: { show: true },
  rightFoot: { show: true },
};

const FallbackBodyModel = () => {
  return (
    <svg
      viewBox="0 0 120 300"
      role="img"
      aria-label="Human body model"
      className="mx-auto h-[27rem] w-[11rem]"
    >
      <rect x="47" y="8" width="26" height="20" rx="6" fill="#ef4444" />
      <rect x="50" y="30" width="20" height="16" rx="4" fill="#ef4444" />

      <rect x="32" y="46" width="18" height="24" rx="4" fill="#67e8f9" />
      <rect x="70" y="46" width="18" height="24" rx="4" fill="#67e8f9" />
      <rect x="45" y="46" width="30" height="30" rx="6" fill="#ef4444" />
      <rect x="42" y="78" width="36" height="44" rx="8" fill="#67e8f9" />

      <rect x="20" y="76" width="16" height="74" rx="6" fill="#67e8f9" />
      <rect x="84" y="76" width="16" height="74" rx="6" fill="#ef4444" />
      <rect x="16" y="148" width="16" height="18" rx="6" fill="#ef4444" />
      <rect x="88" y="148" width="16" height="18" rx="6" fill="#67e8f9" />

      <rect x="40" y="124" width="18" height="124" rx="8" fill="#67e8f9" />
      <rect x="62" y="124" width="18" height="124" rx="8" fill="#67e8f9" />
      <rect x="38" y="248" width="20" height="14" rx="5" fill="#67e8f9" />
      <rect x="62" y="248" width="20" height="14" rx="5" fill="#67e8f9" />
    </svg>
  );
};

const HumanBodyModel = ({ onPartClick }: HumanBodyModelProps) => {
  const SafeBodyComponent = BodyComponent as unknown as
    | ((props: { partsInput: typeof partsInput; onClick?: (part: string) => void }) => JSX.Element)
    | undefined;

  if (!SafeBodyComponent) {
    return <FallbackBodyModel />;
  }

  return (
    <BodyModelErrorBoundary>
      <div className="human-body-panel mx-auto w-full max-w-[18rem] scale-[0.95] origin-top -mt-8 sm:-mt-10">
        <style>{`.human-body-panel svg.selected path { fill: #ef4444 !important; }`}</style>
        <SafeBodyComponent partsInput={partsInput} onClick={(part) => onPartClick?.(String(part))} />
      </div>
    </BodyModelErrorBoundary>
  );
};

export default HumanBodyModel;