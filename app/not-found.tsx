import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <h1>Página não encontrada</h1>
      <p className="muted">
        <Link href="/">Voltar para a home</Link>
      </p>
    </div>
  );
}
