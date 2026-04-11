import React from "react";

export type RecurButtonProps = {
  label?: string;
};

export function RecurButton({ label = "Subscribe" }: RecurButtonProps): React.ReactElement {
  return React.createElement("button", { id: "recur-subscribe-button" }, label);
}
