import "server-only";
import type { PaymentProvider } from "./types";
import { activeProvider } from "./config";
import { SimulationProvider } from "./simulation";
import { MidtransProvider } from "./midtrans";
import { TripayProvider } from "./tripay";
import { PakasirProvider } from "./pakasir";

export * from "./types";
export {
  activeProvider,
  configuredProvider,
  paymentStatus,
  appBaseUrl,
} from "./config";

export function getPaymentProvider(): PaymentProvider {
  switch (activeProvider()) {
    case "midtrans":
      return new MidtransProvider();
    case "tripay":
      return new TripayProvider();
    case "pakasir":
      return new PakasirProvider();
    default:
      return new SimulationProvider();
  }
}

export function isSimulation() {
  return activeProvider() === "simulation";
}
