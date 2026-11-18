import unittest
from unittest.mock import MagicMock
from routing.viago_maneuvers import graph_maneuvers


def fake_db(rows):
    db = MagicMock()
    db.cursor.return_value.__enter__.return_value.fetchall.return_value = rows
    return db

class GraphGuidanceTests(unittest.TestCase):
    def test_verified_left_at_distinct_connected_way(self):
        # East then north: negative signed bearing delta -> left.
        result = graph_maneuvers(
            portions=[(20,0,1),(22,0,1)],
            segments=[([[0,0],[0.001,0]],111.2), ([[0.001,0],[0.001,0.001]],111.2)],
            total_m=222.4,
            db_connection=fake_db([(10,100,1,2),(11,200,2,3)]))
        self.assertEqual(result[0]['modifier'],'left')
        self.assertEqual(result[0]['distance_from_start_m'],111.2)
        self.assertEqual(result[-1]['kind'],'arrive')

    def test_same_way_bend_never_emits_turn(self):
        result = graph_maneuvers(portions=[(20,0,1),(22,0,1)],
            segments=[([[0,0],[0.001,0]],111), ([[0.001,0],[0.001,0.001]],111)],
            total_m=222, db_connection=fake_db([(10,100,1,2),(11,100,2,3)]))
        self.assertEqual([x['kind'] for x in result],['arrive'])

    def test_missing_topology_fails_closed(self):
        result = graph_maneuvers(portions=[(20,0,1),(22,0,1)],
            segments=[([[0,0],[0.001,0]],111), ([[0.001,0],[0.001,0.001]],111)],
            total_m=222, db_connection=fake_db([(10,100,1,2)]))
        self.assertEqual(result,[])

    def test_disconnected_nodes_fail_closed(self):
        result = graph_maneuvers(portions=[(20,0,1),(22,0,1)],
            segments=[([[0,0],[0.001,0]],111), ([[0.001,0],[0.001,0.001]],111)],
            total_m=222, db_connection=fake_db([(10,100,1,2),(11,200,9,3)]))
        self.assertEqual(result,[])

    def test_database_query_uses_actual_edge_id_column(self):
        from routing.viago_maneuvers import TOPOLOGY_SQL
        self.assertIn('SELECT edge_id, way_id, source, target', TOPOLOGY_SQL)
        self.assertNotIn('SELECT id, way_id, source, target', TOPOLOGY_SQL)

    def test_no_route_no_maneuvers(self):
        self.assertEqual(graph_maneuvers(portions=[], segments=[], total_m=0,
                                        db_connection=fake_db([])),[])

if __name__ == '__main__': unittest.main()
