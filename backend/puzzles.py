import random

PUZZLES = [
    {
        "id": "two_sum",
        "title": "Two Sum",
        "description": "Write a function `two_sum(nums, target)` that returns the indices (as a list) of the two numbers in `nums` such that they add up to `target`. You may assume each input has exactly one solution.",
        "initial_code": "def two_sum(nums:\n    # Write your solution here\n    pass\n",
        "test_cases": [
            "assert two_sum([2, 7, 11, 15], 9) in [[0, 1], [1, 0]]",
            "assert two_sum([3, 2, 4], 6) in [[1, 2], [2, 1]]",
            "assert two_sum([3, 3], 6) in [[0, 1], [1, 0]]"
        ]
    },
    {
        "id": "fibonacci",
        "title": "Nth Fibonacci",
        "description": "Write a function `fib(n)` that returns the nth number in the Fibonacci sequence. fib(0) = 0, fib(1) = 1. The sequence grows as 0, 1, 1, 2, 3, 5, 8, 13...",
        "initial_code": "def fib(n: int) -> int:\n    # Write your solution here\n    pass\n",
        "test_cases": [
            "assert fib(0) == 0",
            "assert fib(1) == 1",
            "assert fib(5) == 5",
            "assert fib(10) == 55"
        ]
    },
    {
        "id": "valid_palindrome",
        "title": "Valid Palindrome",
        "description": "Write a function `is_palindrome(s)` that returns True if the string `s` is a palindrome (reads the same forward and backward). Assume alphanumeric and case-insensitive.",
        "initial_code": "def is_palindrome(s: str) -> bool:\n    # Clean the string and check\n    pass\n",
        "test_cases": [
            "assert is_palindrome('A man, a plan, a canal: Panama') == True",
            "assert is_palindrome('race a car') == False",
            "assert is_palindrome(' ') == True"
        ]
    }
]

def get_random_puzzle():
    return random.choice(PUZZLES)
