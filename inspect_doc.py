import docx

doc = docx.Document('template_report.docx')
for i in [0, 2, 10, 48, 106, 110, 132, 133, 134]:
    p = doc.paragraphs[i]
    print(f'P{i}: text="{p.text[:60]}", style="{p.style.name}"')
    for j, r in enumerate(p.runs):
        font_name = r.font.name if r.font else None
        font_size = r.font.size.pt if (r.font and r.font.size) else None
        color = r.font.color.rgb if (r.font and r.font.color) else None
        print(f'   Run {j}: "{r.text[:30]}" font={font_name}, size={font_size}, bold={r.bold}, italic={r.italic}, color={color}')
