import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import WanderPlanLLMFlow from "./WanderPlanLLMFlow";

function bootIntoTripsDashboard() {
  window.localStorage.clear();
  window.localStorage.setItem("wp-auth", JSON.stringify("test-token:00000000-0000-0000-0000-000000000001"));
  window.localStorage.setItem(
    "wp-login-creds",
    JSON.stringify({ remember: true, email: "tester@example.com", password: "Passw0rd!" })
  );
  window.localStorage.setItem(
    "wp-u",
    JSON.stringify({ name: "Tester", email: "tester@example.com", budget: "moderate", dietary: [], styles: [], interests: {} })
  );
  render(<WanderPlanLLMFlow />);
}

async function openTripDetail() {
  bootIntoTripsDashboard();
  await waitFor(() => expect(screen.getByText("My Trips")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Tokyo Discovery Sprint"));
  await waitFor(() => expect(screen.getByText("EXPENSE MANAGEMENT")).toBeInTheDocument());
}

describe("WanderPlanLLMFlow trip detail expenses", () => {
  test("B-11 shows expense categories", async () => {
    await openTripDetail();

    expect(screen.getAllByText("Transport").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Accommodation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Food").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Activities").length).toBeGreaterThan(0);
  });

  test("B-09 deleting an expense recalculates running total", async () => {
    await openTripDetail();

    // Add an expense so there is something to delete
    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Hotel Maui" } });
    fireEvent.change(screen.getByLabelText("Expense category"), { target: { value: "Accommodation" } });
    fireEvent.change(screen.getByLabelText("Expense amount"), { target: { value: "432" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    expect(screen.getByText("Hotel Maui")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Delete Hotel Maui expense"));

    expect(screen.queryByText("Hotel Maui")).not.toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  test("B-12 add 3 expenses computes exact total", async () => {
    await openTripDetail();

    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Metro Pass" } });
    fireEvent.change(screen.getByLabelText("Expense category"), { target: { value: "Transport" } });
    fireEvent.change(screen.getByLabelText("Expense amount"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Cafe Breakfast" } });
    fireEvent.change(screen.getByLabelText("Expense category"), { target: { value: "Food" } });
    fireEvent.change(screen.getByLabelText("Expense amount"), { target: { value: "20.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Kayak Rental" } });
    fireEvent.change(screen.getByLabelText("Expense category"), { target: { value: "Activities" } });
    fireEvent.change(screen.getByLabelText("Expense amount"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    expect(screen.getByText("$60.50")).toBeInTheDocument();
  });

  test("B-14 transport filter shows only transport expenses", async () => {
    await openTripDetail();

    // Add a transport expense and an accommodation expense to verify filtering
    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Airport Shuttle" } });
    fireEvent.change(screen.getByLabelText("Expense category"), { target: { value: "Transport" } });
    fireEvent.change(screen.getByLabelText("Expense amount"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Hotel Maui" } });
    fireEvent.change(screen.getByLabelText("Expense category"), { target: { value: "Accommodation" } });
    fireEvent.change(screen.getByLabelText("Expense amount"), { target: { value: "220" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    fireEvent.change(screen.getByLabelText("Filter expenses by category"), { target: { value: "transport" } });

    expect(screen.getByText("Airport Shuttle")).toBeInTheDocument();
    expect(screen.queryByText("Hotel Maui")).not.toBeInTheDocument();
  });
});
