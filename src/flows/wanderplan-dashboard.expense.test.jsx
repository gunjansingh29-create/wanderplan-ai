import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Dashboard from "./wanderplan-dashboard";

function openBudgetTab() {
  render(<Dashboard />);
  fireEvent.click(screen.getByText("Greek Island Hopping"));
  fireEvent.click(screen.getAllByRole("button", { name: /budget/i })[1]);
}

describe("Trip detail expense management", () => {
  test("B-11 shows expense categories", () => {
    openBudgetTab();

    expect(screen.getAllByText("Transport").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Accommodation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Food").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Activities").length).toBeGreaterThan(0);
  });

  test("B-09 deletes an expense and recalculates running total", () => {
    openBudgetTab();

    // Add an expense first so we have something to delete
    const nameInput = screen.getByLabelText("Expense name");
    const categorySelect = screen.getByLabelText("Expense category");
    const amountInput = screen.getByLabelText("Expense amount");

    fireEvent.change(nameInput, { target: { value: "Hotel Maui" } });
    fireEvent.change(categorySelect, { target: { value: "Accommodation" } });
    fireEvent.change(amountInput, { target: { value: "220" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    expect(screen.getByText("Hotel Maui")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Delete Hotel Maui expense"));

    expect(screen.queryByText("Hotel Maui")).not.toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  test("B-12 adds 3 expenses and total equals exact sum", () => {
    openBudgetTab();

    const nameInput = screen.getByLabelText("Expense name");
    const categorySelect = screen.getByLabelText("Expense category");
    const amountInput = screen.getByLabelText("Expense amount");

    fireEvent.change(nameInput, { target: { value: "Metro Pass" } });
    fireEvent.change(categorySelect, { target: { value: "Transport" } });
    fireEvent.change(amountInput, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    fireEvent.change(nameInput, { target: { value: "Cafe Breakfast" } });
    fireEvent.change(categorySelect, { target: { value: "Food" } });
    fireEvent.change(amountInput, { target: { value: "20.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    fireEvent.change(nameInput, { target: { value: "Kayak Rental" } });
    fireEvent.change(categorySelect, { target: { value: "Activities" } });
    fireEvent.change(amountInput, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    expect(screen.getByText("$60.50")).toBeInTheDocument();
  });

  test("B-14 filters by Transport and shows only transport expenses", () => {
    openBudgetTab();

    // Add a transport expense and a food expense so we can verify filtering
    const nameInput = screen.getByLabelText("Expense name");
    const categorySelect = screen.getByLabelText("Expense category");
    const amountInput = screen.getByLabelText("Expense amount");

    fireEvent.change(nameInput, { target: { value: "Airport Shuttle" } });
    fireEvent.change(categorySelect, { target: { value: "Transport" } });
    fireEvent.change(amountInput, { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    fireEvent.change(nameInput, { target: { value: "Hotel Maui" } });
    fireEvent.change(categorySelect, { target: { value: "Accommodation" } });
    fireEvent.change(amountInput, { target: { value: "220" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Expense" }));

    fireEvent.change(screen.getByLabelText("Filter expenses by category"), { target: { value: "Transport" } });

    expect(screen.getByText("Airport Shuttle")).toBeInTheDocument();
    expect(screen.queryByText("Hotel Maui")).not.toBeInTheDocument();
  });
});

// CI trigger
