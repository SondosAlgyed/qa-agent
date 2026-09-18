import { expect, test } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage.js";

// Hand-written reference tests: the agent reads these to learn our conventions.
test.describe("Login", () => {
  test("EXAMPLE TC-01: valid user can log in", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("standard_user", "secret_sauce");
    await expect(page).toHaveURL(/inventory/);
  });

  test("EXAMPLE TC-02: wrong password shows an error", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("standard_user", "wrong_password");
    await loginPage.expectError("do not match");
  });
});
