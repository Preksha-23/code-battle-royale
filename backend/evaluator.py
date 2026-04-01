import subprocess
import tempfile
import os

def evaluate_code(code: str, test_cases: list[str]) -> dict:
    """
    Evaluates the provided Python code against a list of assert statements.
    Returns:
        {
            "success": bool,
            "error_msg": str or None,
            "failed_test": str or None
        }
    """
    # Construct the full script to run
    # We put the user code first, then run through the test cases sequentially.
    script_lines = [code, "\n# ---- TEST CASES ----\n"]
    
    # We will wrap each assertion in a try-except block so we can identify specifically which one failed
    for i, test in enumerate(test_cases):
        script_lines.append(f"try:\n    {test}\nexcept AssertionError:\n    print('TEST_FAIL: {test}')\n    exit(1)\nexcept Exception as e:\n    print(f'EXEC_FAIL: {{e}}')\n    exit(1)")

    full_script = "\n".join(script_lines)
    
    # Store it in a temporary file to execute
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as temp_script:
        temp_script.write(full_script)
        temp_path = temp_script.name

    try:
        # Run the script using Python subprocess
        # We enforce a strict timeout to prevent infinite loops (e.g. while True:)
        result = subprocess.run(
            ["python", temp_path],
            capture_output=True,
            text=True,
            timeout=3.0
        )
        
        # Check standard output for our custom error tags
        output = result.stdout + result.stderr

        if "TEST_FAIL:" in output:
            failed_test = output.split("TEST_FAIL: ")[1].split("\n")[0]
            return {"success": False, "error_msg": "Test case failed.", "failed_test": failed_test}
            
        if "EXEC_FAIL:" in output:
            exec_fail = output.split("EXEC_FAIL: ")[1].split("\n")[0]
            return {"success": False, "error_msg": f"Runtime Error: {exec_fail}", "failed_test": None}

        # Check raw return code (syntax errors, crashes)
        if result.returncode != 0:
            # Clean up the output to avoid leaking local filesystem paths
            clean_error = result.stderr.replace(temp_path, "solution.py").strip()
            return {"success": False, "error_msg": clean_error, "failed_test": None}

        return {"success": True, "error_msg": None, "failed_test": None}

    except subprocess.TimeoutExpired:
        return {"success": False, "error_msg": "Execution timed out (3.0s limit exceeded).", "failed_test": None}
    finally:
        # Always clean up the temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
