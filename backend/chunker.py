import ast
from pathlib import Path


def _is_test_file(filepath: str) -> bool:
    path = Path(filepath)
    return "tests" in path.parts or path.stem.startswith("test_") or path.stem.endswith("_test")


def _walk_and_collect(node, filepath, source, is_test, class_name=None):
    """Recursively collect function chunks, tracking which class (if any) each belongs to."""
    chunks = []

    for child in ast.iter_child_nodes(node):
        if isinstance(child, ast.ClassDef):
            # Don't save the class itself as a chunk — recurse into it,
            # remembering its name so methods inside get tagged with it.
            chunks.extend(_walk_and_collect(child, filepath, source, is_test, class_name=child.name))

        elif isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
            chunks.append({
                "file": filepath,
                "name": child.name,
                "type": type(child).__name__,
                "class_name": class_name,   # None for top-level functions, set for methods
                "start_line": child.lineno,
                "end_line": child.end_lineno,
                "source": ast.get_source_segment(source, child),
                "is_test": is_test,
            })
            # Still recurse in case there's a nested function inside this one
            chunks.extend(_walk_and_collect(child, filepath, source, is_test, class_name=class_name))

    return chunks


def chunk_file(filepath: str) -> list[dict]:
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()

    tree = ast.parse(source, filename=filepath)
    return _walk_and_collect(tree, filepath, source, _is_test_file(filepath))


def chunk_repo(repo_path: str) -> list[dict]:
    all_chunks = []
    for path in Path(repo_path).rglob("*.py"):
        try:
            all_chunks.extend(chunk_file(str(path)))
        except SyntaxError:
            continue
    return all_chunks