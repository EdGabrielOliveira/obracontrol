#!/usr/bin/env python3
"""Convert one DOCX to PDF with an isolated, bounded LibreOffice process.

The application keeps DOCX fidelity by using LibreOffice's Writer filters, but
the conversion boundary lives in a short-lived Python process. This avoids
loading office integration code into Bun and guarantees that a stuck conversion
cannot keep a LibreOffice profile or process alive indefinitely.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_TIMEOUT_SECONDS = 45


def terminate_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    if os.name != "nt":
        try:
            os.killpg(process.pid, signal.SIGKILL)
            return
        except ProcessLookupError:
            return
    process.kill()


def main() -> int:
    if len(sys.argv) != 3:
        print("uso: convert-docx-to-pdf.py ENTRADA.docx SAIDA.pdf", file=sys.stderr)
        return 2

    input_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()
    if not input_path.is_file() or input_path.suffix.lower() != ".docx":
        print("entrada DOCX inválida", file=sys.stderr)
        return 2
    output_path.parent.mkdir(parents=True, exist_ok=True)

    executable = os.environ.get("LIBREOFFICE_BIN", "soffice")
    try:
        timeout = max(
            5,
            int(
                os.environ.get(
                    "PDF_CONVERSION_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS
                )
            ),
        )
    except ValueError:
        timeout = DEFAULT_TIMEOUT_SECONDS

    with tempfile.TemporaryDirectory(prefix="obracontrol-lo-") as profile:
        profile_uri = Path(profile).as_uri()
        environment = os.environ.copy()
        environment.update(
            {
                "HOME": profile,
                "SAL_USE_VCLPLUGIN": "svp",
                "SAL_DISABLE_OPENCL": "1",
            }
        )
        command = [
            executable,
            f"-env:UserInstallation={profile_uri}",
            "--headless",
            "--nologo",
            "--nodefault",
            "--nofirststartwizard",
            "--norestore",
            "--nolockcheck",
            "--convert-to",
            "pdf:writer_pdf_Export",
            "--outdir",
            str(output_path.parent),
            str(input_path),
        ]
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=environment,
                start_new_session=(os.name != "nt"),
            )
        except OSError as error:
            print(f"não foi possível iniciar o LibreOffice: {error}", file=sys.stderr)
            return 127
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            terminate_process(process)
            process.communicate()
            print(f"conversão excedeu {timeout}s", file=sys.stderr)
            return 124

        if process.returncode != 0:
            detail = (stderr or stdout).strip().replace("\n", " ")[:500]
            print(f"LibreOffice retornou {process.returncode}: {detail}", file=sys.stderr)
            return process.returncode or 1

    produced_path = output_path.parent / input_path.with_suffix(".pdf").name
    if not produced_path.is_file() or produced_path.stat().st_size == 0:
        print("PDF vazio ou não gerado", file=sys.stderr)
        return 1
    if produced_path != output_path:
        produced_path.replace(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
