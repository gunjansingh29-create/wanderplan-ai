import { fireEvent, render, screen } from "@testing-library/react";
import BucketListAgent from "./wanderplan-bucket-list-agent";

describe("BucketListAgent empty submit validation", () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  test("shows inline validation and does not submit when Send is clicked with empty input", () => {
    render(<BucketListAgent />);

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.queryByText("Please enter a destination to search.")).not.toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Type destinations… e.g. Tokyo, Paris, Bali"), {
      target: { value: "Tokyo" },
    });

    expect(screen.queryByText("Please enter a destination to search.")).toBeNull();
  });
});
