import { createFileRoute } from "@tanstack/react-router";
import { SimScreen } from "@/components/moka/SimScreen";
import { getCatalog } from "@/lib/moka/catalog.functions";

export const Route = createFileRoute("/")({
  loader: () => getCatalog(),
  component: Home,
});

function Home() {
  const catalog = Route.useLoaderData();
  return <SimScreen initial={catalog} />;
}
