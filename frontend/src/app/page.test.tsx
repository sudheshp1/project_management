import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Home from "@/app/page";
import { mockApi } from "@/test/mockApi";

const signIn = async (password: string) => {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Username"), "user");
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("shows the login form when signed out", async () => {
    mockApi({ signedIn: false });
    render(<Home />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("restores an existing session", async () => {
    mockApi();
    render(<Home />);

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("rejects invalid credentials", async () => {
    mockApi({ signedIn: false });
    render(<Home />);

    await signIn("wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password.");
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("signs in and logs out", async () => {
    const { fetchMock } = mockApi({ signedIn: false });
    render(<Home />);

    await signIn("password");
    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/logout", { method: "POST" });
  });
});
