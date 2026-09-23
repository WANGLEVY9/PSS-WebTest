import copy
import unittest
from vwa_task_mapping import match


class VwaMappingTests(unittest.TestCase):
    def test_duplicate_intents_require_full_content_not_fuzzy_match(self):
        a={'task_id':1,'intent':'Same public instruction','image':'environment_docker/webarena-homepage/static/a.png','eval':{'target':'A'}}
        b={**a,'task_id':2,'eval':{'target':'B'}}
        port=[{**a,'task_id':500,'image':'__HOMEPAGE__/static/a.png'},
              {**b,'task_id':501,'image':'__HOMEPAGE__/static/a.png'}]
        rows=match([('vwa:site:1',a),('vwa:site:2',b)],port)
        self.assertEqual([r['port_global_task_id'] for r in rows],[500,501])
        self.assertEqual(a['image'],'environment_docker/webarena-homepage/static/a.png')

    def test_changed_evaluator_or_image_cannot_silently_match(self):
        a={'task_id':0,'intent':'Task','image':'a.png','eval':{'target':'A'}}
        for change in ({'image':'b.png'},{'eval':{'target':'B'}}):
            with self.assertRaises(ValueError):match([('vwa:a:0',a)],[{**a,**change}])

    def test_ambiguous_content_and_unmapped_extras_rejected(self):
        a={'task_id':0,'intent':'Task','image':None}
        with self.assertRaises(ValueError):match([('vwa:a:0',a)],[a,{**a,'task_id':1}])
        with self.assertRaises(ValueError):match([('vwa:a:0',a)],[a,{**a,'task_id':1,'intent':'Other'}])


if __name__=='__main__':unittest.main()
