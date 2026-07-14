import { MARKS, type AdvancedValues, type Mode } from "../types";

interface Props {
  mode: Mode;
  values: AdvancedValues;
  onChange: (patch: Partial<AdvancedValues>) => void;
}

function NumberField(props: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  step?: string;
  min?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={props.id}>
        {props.label}
      </label>
      <input
        id={props.id}
        type="number"
        min={props.min}
        step={props.step}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

export default function ModeOptions({ mode, values, onChange }: Props) {
  if (mode === "visible") {
    return (
      <div className="block field">
        <label className="label" htmlFor="mark">
          Visible mark
        </label>
        <select id="mark" value={values.mark} onChange={(e) => onChange({ mark: e.target.value })}>
          <option value="auto">Auto detect</option>
          {MARKS.filter((m) => m !== "auto").map((m) => (
            <option key={m} value={m}>
              {m[0].toUpperCase() + m.slice(1)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (mode !== "all" && mode !== "invisible") return null;

  return (
    <details className="block adv">
      <summary>Advanced options</summary>
      <div className="adv-body">
        <div className="row">
          <NumberField id="strength" label="Strength" placeholder="auto" min="0" step="0.01" value={values.strength} onChange={(v) => onChange({ strength: v })} />
          <NumberField id="steps" label="Steps" placeholder="50" min="1" step="1" value={values.steps} onChange={(v) => onChange({ steps: v })} />
        </div>
        <div className="row">
          <NumberField id="maxResolution" label="Max res" placeholder="native" min="1" step="1" value={values.maxResolution} onChange={(v) => onChange({ maxResolution: v })} />
          <NumberField id="humanize" label="Humanize" placeholder="0" min="0" step="0.1" value={values.humanize} onChange={(v) => onChange({ humanize: v })} />
        </div>
        <div className="row">
          <div>
            <label className="label" htmlFor="pipeline">
              Pipeline
            </label>
            <select id="pipeline" value={values.pipeline} onChange={(e) => onChange({ pipeline: e.target.value })}>
              <option value="">Default</option>
              <option value="controlnet">ControlNet</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="device">
              Device
            </label>
            <select id="device" value={values.device} onChange={(e) => onChange({ device: e.target.value })}>
              <option value="">Auto</option>
              <option value="cpu">CPU</option>
              <option value="mps">MPS</option>
              <option value="cuda">CUDA</option>
              <option value="xpu">XPU</option>
            </select>
          </div>
        </div>
      </div>
    </details>
  );
}
