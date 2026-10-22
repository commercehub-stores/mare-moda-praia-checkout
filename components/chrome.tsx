import { asset, STORE_URL } from "@/lib/paths.ts";

/** Checkout top bar (Figma D5): logo back to the store, 3-step progress, "Ambiente 100% seguro". */
export function CheckoutBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Sacola", "Pagamento", "Confirmação"];
  return (
    <header className="co-bar">
      <a href={STORE_URL} className="logo" aria-label="Voltar para a loja Maré">
        <span className="logo-word">maré</span>
        <span className="logo-tag">MODA PRAIA</span>
      </a>
      <ol className="co-steps" aria-label="Etapas">
        {steps.map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li key={label} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className="co-step-dot">{state === "done" ? <img src={asset("/icons/co-check.svg")} alt="" width={12} height={12} /> : n}</span>
              <span className="co-step-label">{label}</span>
            </li>
          );
        })}
      </ol>
      <span className="co-secure">
        <img src={asset("/icons/co-lock.svg")} alt="" width={16} height={16} />
        Ambiente 100% seguro
      </span>
    </header>
  );
}
