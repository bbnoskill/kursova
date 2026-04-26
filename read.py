import zipfile
import xml.etree.ElementTree as ET

docx_path = r"c:\Study\sem6\Курсова\Андрієвський_ПЗ-31_Проміжний_звіт.docx"
with zipfile.ZipFile(docx_path) as zf:
    with zf.open('word/document.xml') as f:
        xml_content = f.read()

tree = ET.fromstring(xml_content)
namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
text = ""
for paragraph in tree.findall('.//w:p', namespaces):
    chunk = []
    for run in paragraph.findall('.//w:r', namespaces):
        for t in run.findall('.//w:t', namespaces):
            if t.text:
                chunk.append(t.text)
    if chunk:
        text += "".join(chunk) + "\n"

with open(r"c:\Study\sem6\Курсова\report.txt", "w", encoding="utf-8") as f:
    f.write(text)
print("Done")
