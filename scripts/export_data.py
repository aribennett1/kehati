#!/usr/bin/env python3
import json
import re
import shutil
import sqlite3
import sys
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLAIN_DB = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/kehati_plain.sqlite")
APK_ASSETS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("/tmp/kehati_apktool/assets")
OUT = ROOT


def normalize_asset_refs(text):
    text = text.replace("file:///android_asset/", "assets/")
    text = re.sub(r'(?P<attr>\b(?:src|href)=["\'])pics/', r"\g<attr>assets/pics/", text)
    return re.sub(r'<img\b[^>]*\bsrc=["\']images/[^"\']+["\'][^>]*>', "", text)


def inflate(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return normalize_asset_refs(value)
    try:
        return normalize_asset_refs(zlib.decompress(value).decode("utf-8"))
    except zlib.error:
        return normalize_asset_refs(value.decode("utf-8", errors="replace"))


def row_dict(cursor, row):
    return {description[0]: value for description, value in zip(cursor.description, row)}


def main():
    if not PLAIN_DB.exists():
        raise SystemExit(f"Plain database not found: {PLAIN_DB}")

    (OUT / "data" / "masechtot").mkdir(parents=True, exist_ok=True)
    (OUT / "assets").mkdir(parents=True, exist_ok=True)
    old_bundle = OUT / "data" / "mishnayot.json"
    if old_bundle.exists():
        old_bundle.unlink()

    con = sqlite3.connect(PLAIN_DB)
    con.row_factory = row_dict

    sedarim = con.execute("select id, en_name, he_name from seder order by id").fetchall()
    masechtot = con.execute(
        """
        select id, en_name, he_name, seder_id, hakdama_txt, hakdama_en_txt
        from massechet
        order by id
        """
    ).fetchall()
    perakim = con.execute(
        """
        select id, massechet_id, perek_num, from_mishna, to_mishna
        from perek
        order by massechet_id, perek_num
        """
    ).fetchall()
    mishnayot = con.execute(
        """
        select id, massechet_id, perek, mishna_num, letter, mishna_txt,
               bartenura_txt, kehati_txt, english_txt, mishna_sdura
        from m
        order by id
        """
    ).fetchall()

    for masechet in masechtot:
        masechet["hakdama_txt"] = inflate(masechet["hakdama_txt"])
        masechet["hakdama_en_txt"] = inflate(masechet["hakdama_en_txt"])

    for mishna in mishnayot:
        for field in ("mishna_txt", "bartenura_txt", "kehati_txt", "english_txt", "mishna_sdura"):
            mishna[field] = inflate(mishna[field])

    mishna_index = [
        {
            "id": mishna["id"],
            "massechet_id": mishna["massechet_id"],
            "perek": mishna["perek"],
            "mishna_num": mishna["mishna_num"],
        }
        for mishna in mishnayot
    ]

    (OUT / "data" / "index.json").write_text(
        json.dumps(
            {
                "sedarim": sedarim,
                "masechtot": masechtot,
                "perakim": perakim,
                "mishnayot": mishna_index,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    for masechet in masechtot:
        rows = [mishna for mishna in mishnayot if mishna["massechet_id"] == masechet["id"]]
        (OUT / "data" / "masechtot" / f"{masechet['id']}.json").write_text(
            json.dumps(rows, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    for asset in (
        "Alef-Regular.ttf",
        "Alef-Bold.ttf",
        "AdobeHebrew.ttf",
        "GuttmanDrogolin.ttf",
        "KeterYG-Medium.ttf",
        "NRKIS.ttf",
        "STAM.TTF",
        "frankruehlclm-medium-webfont.ttf",
        "oprFrank-Bold.otf",
        "oprFrank-Normal.otf",
        "logo_k.png",
    ):
        source = APK_ASSETS / asset
        if source.exists():
            shutil.copy2(source, OUT / "assets" / asset)

    pics = APK_ASSETS / "pics"
    if pics.exists():
        target = OUT / "assets" / "pics"
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(pics, target)

    print(f"Exported {len(mishnayot)} mishnayot, {len(masechtot)} masechtot.")


if __name__ == "__main__":
    main()
