/**
 * Below are routes for department-clud system
 */

const Router = require('express').Router()


/**
 * import all routes
 */

const create_department = require('../../controllers/department_crud/create_department.js')
const list_all_departments = require('../../controllers/department_crud/list_all_departments.js')
const get_department_by_id = require('../../controllers/department_crud/get_department_by_id.js')
const update_department = require('../../controllers/department_crud/update_department.js')
const delete_department = require('../../controllers/department_crud/delete_department.js')


Router.get('/', list_all_departments)
Router.get('/:department_id', get_department_by_id)
Router.post('/', create_department)
Router.put('/:id', update_department)
Router.delete('/:id', delete_department)


module.exports = Router