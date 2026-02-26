import pexpect
import sys
import time

child = pexpect.spawn('npm run shopify app generate extension -- --template theme --name nutaan-chatbot-theme', encoding='utf-8')
child.logfile = sys.stdout

try:
    child.expect('App name', timeout=120)
    time.sleep(1)
    child.sendline('Nutaan Live Chat')
    
    # Wait for the rest of the generation
    child.expect(pexpect.EOF, timeout=120)

except pexpect.TIMEOUT:
    print("\nTimeout occurred!")
    print(child.before)
except pexpect.EOF:
    print("\nUnexpected EOF!")
    print(child.before)
