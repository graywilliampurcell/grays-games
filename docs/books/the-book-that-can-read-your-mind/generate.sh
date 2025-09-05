#/bin/bash

# 1. Create a PDF
PDF_FILE='dist/The Book That Can Read Your Mind: Gray Edition.pdf'
if [ ! -f "$PDF_FILE" ]
then
    echo "Generating PDF..."
    convert mod/page*.png "$PDF_FILE"
else
    echo "PDF already exists."
fi

# 2. Create an EPUB
EPUB_FILE='dist/The Book That Can Read Your Mind: Gray Edition.epub'
if [ ! -f "$EPUB_FILE" ]
then
    echo "Generating EPUB..."
    pandoc template/epub.html -o "$EPUB_FILE"
else
    echo "EPUB already exists."
fi
