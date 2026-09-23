import unittest
from wav_shopping_auth import authenticate_shopping

class ShoppingAuthGuards(unittest.TestCase):
    def test_reset_is_required_before_browser_or_credentials(self):
        with self.assertRaisesRegex(ValueError,'reset required'):
            authenticate_shopping(None,{'scope':'diagnostic'},{},'x',{}, {},'/unused')
    def test_wrong_lease_cannot_authenticate(self):
        op={'scope':'diagnostic','opportunity_id':'a','environment_id':'b','configuration_sha256':'c','lease_token':'d'}
        reset={**op,'restored':True,'lease_token':'wrong'}
        with self.assertRaisesRegex(ValueError,'binding mismatch'):
            authenticate_shopping(None,op,reset,'x',{}, {},'/unused')

if __name__=='__main__':unittest.main()
