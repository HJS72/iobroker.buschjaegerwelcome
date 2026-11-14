const form = document.getElementById("gateway-form");
const result = document.getElementById("result");
const details = document.getElementById("details");
const button = form.querySelector("button");

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    result.textContent = "Anmeldung wird geprüft …";
    details.textContent = "";
    try {
        const response = await fetch("/api/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                gatewayIp: form.elements.gatewayIp.value.trim(),
                gatewayPort: Number(form.elements.gatewayPort.value),
                username: form.elements.username.value,
                password: form.elements.password.value,
            }),
        });
        if (!response.ok) {
            result.textContent = `Test fehlgeschlagen (HTTP ${response.status}). Prüfe IPv4-Adresse und Eingaben.`;
            return;
        }
        const data = await response.json();
        result.textContent = !data.login ? "Anmeldung fehlgeschlagen." :
            data.health ? "Anmeldung und Health-Check erfolgreich." : "Anmeldung erfolgreich, Health-Check fehlgeschlagen.";
        details.textContent = data.messages.join("\n");
    } catch {
        result.textContent = "Testserver nicht erreichbar.";
    } finally {
        button.disabled = false;
    }
});
