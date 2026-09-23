def run(session, public_task):
    electronics = session.get_by_role('link', name='Electronics', exact=True)
    electronics.hover()
    session.get_by_role('link', name='Headphones', exact=True).click()
    return '{"task_type":"NAVIGATE","status":"SUCCESS","retrieved_data":null}'
