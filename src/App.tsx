import { useState, useEffect, useRef } from "react";
import { codeToHtml, ThemeRegistrationAny } from "shiki";
import "./App.css";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import "./GoogleSansCode-VariableFont_wght-normal.js";

const customTheme = {
    name: "custom-dark",
    type: "dark",
    colors: {
        "editor.background": "#00000000",
        "editor.foreground": "#C9CDE1",
    },
    tokenColors: [
        {
            name: "Comment",
            scope: ["comment", "punctuation.definition.comment"],
            settings: {
                foreground: "#565f89",
            },
        },
        {
            name: "Keywords",
            scope: ["keyword", "storage.type", "storage.modifier"],
            settings: {
                foreground: "#738EDF",
            },
        },
        {
            name: "Operators",
            scope: ["keyword.operator"],
            settings: {
                foreground: "#C9CDE1",
            },
        },
        {
            name: "Punctuation",
            scope: ["punctuation", "meta.brace", "meta.delimiter"],
            settings: {
                foreground: "#C9CDE1",
            },
        },
        {
            name: "Strings",
            scope: ["string", "string.quoted"],
            settings: {
                foreground: "#B9CAF4",
            },
        },
        {
            name: "Variables",
            scope: ["variable", "variable.other", "variable.language"],
            settings: {
                foreground: "#AFBDFF",
            },
        },
        {
            name: "Functions",
            scope: ["entity.name.function", "meta.function-call"],
            settings: {
                foreground: "#AFBDFF",
            },
        },
        {
            name: "Numbers",
            scope: ["constant.numeric"],
            settings: {
                foreground: "#B9CAF4",
            },
        },
        {
            name: "Classes",
            scope: ["entity.name.class", "entity.name.type", "support.class", "support.type"],
            settings: {
                foreground: "#AFBDFF",
            },
        },
        {
            name: "Properties",
            scope: ["variable.other.property", "support.type.property_name"],
            settings: {
                foreground: "#C9CDE1",
            },
        },
        {
            name: "Tags",
            scope: ["entity.name.tag", "meta.tag.sgml"],
            settings: {
                foreground: "#C9CDE1",
            },
        },
        {
            name: "Attributes",
            scope: ["entity.other.attribute-name"],
            settings: {
                foreground: "#C9CDE1",
            },
        },
    ],
} as ThemeRegistrationAny;

const codeAtom = atomWithStorage(
    "code",
    `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log(result);`
);
const languageAtom = atomWithStorage("language", "javascript");
const fontSizeAtom = atomWithStorage("fontSize", "11");

function App() {
    const [code, setCode] = useAtom(codeAtom);
    const [language, setLanguage] = useAtom(languageAtom);
    const [highlightedCode, setHighlightedCode] = useState("");
    const [svgOutput, setSvgOutput] = useState("");
    const [fontSize, setFontSize] = useAtom(fontSizeAtom);
    const codeInputRef = useRef<HTMLTextAreaElement>(null);
    const highlightedCodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateHighlight = async () => {
            try {
                const html = await codeToHtml(code, {
                    lang: language,
                    theme: customTheme,
                });
                setHighlightedCode(html);
            } catch (error) {
                console.error("Error highlighting code:", error);
            }
        };
        updateHighlight();
        generateSVG();
    }, [code, language]);

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (highlightedCodeRef.current) {
            highlightedCodeRef.current.scrollTop = e.currentTarget.scrollTop;
            highlightedCodeRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const generateSVG = async () => {
        try {
            const html = await codeToHtml(code, {
                lang: language,
                theme: customTheme,
            });

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            const preElement = tempDiv.querySelector("pre");
            if (!preElement) throw new Error("No pre element found");

            const codeElement = preElement.querySelector("code");
            if (!codeElement) return;

            const lineHeight = parseInt(fontSize) * 1.55;
            const padding = 20;

            const charWidth = parseInt(fontSize) * 0.6;
            const fontFamily = "'Google Sans Code', monospace";

            const lines = code.split("\n");
            const lineCount = lines.length;
            const maxLineLength = Math.max(...lines.map((l) => l.length));
            const width = Math.max(maxLineLength * charWidth + padding * 2, 400);
            const height = lineCount * lineHeight + padding * 2;

            let svgBody = "";
            const codeLines = codeElement.children;

            for (let i = 0; i < codeLines.length; i++) {
                const line = codeLines[i];
                if (!line) continue;

                const tokens = line.children;
                let cursorX = padding;
                const currentY = i * lineHeight + padding + parseInt(fontSize);

                for (const token of tokens) {
                    // @ts-expect-error nevermind
                    const tokenColor = token.style.color || "#C9CDE1";
                    const tokenText = token.textContent || "";

                    if (!tokenText) continue;

                    const tokenTextEscaped = tokenText
                        .replaceAll(/&/g, "&amp;")
                        .replaceAll(/</g, "&lt;")
                        .replaceAll(/>/g, "&gt;");

                    svgBody += `<text x="${cursorX.toFixed(
                        2
                    )}" y="${currentY}" fill="${tokenColor}" font-family="${fontFamily}" font-size="${fontSize}px" xml:space="preserve">${tokenTextEscaped}</text>`;

                    cursorX += tokenText.length * charWidth;
                }
            }

            const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                ${svgBody}
            </svg>`;

            setSvgOutput(finalSvg);
        } catch (error) {
            console.error("Error generating SVG:", error);
        }
    };

    const downloadSVG = () => {
        if (!svgOutput) return;
        const blob = new Blob([svgOutput], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `highlighted-code-${language}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const downloadPDF = async () => {
        if (!svgOutput) return;

        const tempContainer = document.createElement("div");
        tempContainer.style.visibility = "hidden";
        tempContainer.style.position = "absolute";
        tempContainer.innerHTML = svgOutput;
        const svgElement = tempContainer.querySelector("svg");

        if (!svgElement) return;

        svgElement.style.fontFamily = '"Google Sans Code", monospace';
        document.body.appendChild(tempContainer);

        try {
            const width = parseFloat(svgElement.getAttribute("width") || "400");
            const height = parseFloat(svgElement.getAttribute("height") || "300");

            const pdf = new jsPDF({
                orientation: width > height ? "l" : "p",
                unit: "pt",
                format: [width, height],
            });

            pdf.setFont("Google Sans Code");

            await pdf.svg(svgElement, {
                x: 0,
                y: 0,
                width: width,
                height: height,
                loadExternalStyleSheets: true,
            });

            pdf.save(`code-export-${language}.pdf`);
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            document.body.removeChild(tempContainer);
        }
    };

    return (
        <div className="container">
            <h1>Code Highlighter</h1>

            <div className="controls">
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="language-select">
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="c">C</option>
                    <option value="cpp">C++</option>
                    <option value="rust">Rust</option>
                    <option value="go">Go</option>
                    <option value="csharp">C#</option>
                    <option value="swift">Swift</option>
                    <option value="kotlin">Kotlin</option>
                    <option value="php">PHP</option>
                    <option value="ruby">Ruby</option>
                    <option value="sql">SQL</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                </select>

                {svgOutput && (
                    <button onClick={downloadSVG} className="btn">
                        Download SVG
                    </button>
                )}

                {svgOutput && (
                    <button onClick={downloadPDF} className="btn">
                        Download PDF
                    </button>
                )}

                <span>Font size</span>

                <input
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    onBlur={generateSVG}
                    className="number-input"
                />

            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
                <div className="editor-section">
                    <h2>Editor</h2>
                    <div className="code-container">
                        {highlightedCode && (
                            <div
                                ref={highlightedCodeRef}
                                className="highlighted-code"
                                dangerouslySetInnerHTML={{ __html: highlightedCode }}
                            />
                        )}
                        <textarea
                            ref={codeInputRef}
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value.replaceAll("\t", "    "));
                            }}
                            onScroll={handleScroll}
                            className="code-input"
                            placeholder="Enter your code here..."
                            spellCheck={false}
                        />
                    </div>
                </div>

                {svgOutput && (
                    <div className="svg-section">
                        <h2>SVG Preview</h2>
                        <div className="svg-preview" dangerouslySetInnerHTML={{ __html: svgOutput }} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
