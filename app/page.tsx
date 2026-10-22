import { redirect } from "next/navigation";

/** The checkout layer starts at the cart. */
export default function Home() {
  redirect("/carrinho");
}
